import http.client
import importlib.util
import json
from pathlib import Path
import tempfile
import threading
import unittest

spec = importlib.util.spec_from_file_location('dev', Path(__file__).parents[1] / 'tools/dev.py')
dev = importlib.util.module_from_spec(spec)
spec.loader.exec_module(dev)


class AuthTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.store = dev.Store(Path(self.temp.name) / 'test.sqlite3')
        self.server = dev.SiteServer(('127.0.0.1', 0), 'platform', self.store, 4174, 4173)
        threading.Thread(target=self.server.serve_forever, daemon=True).start()
        self.cookie = ''

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.temp.cleanup()

    def request(self, path, body=None, headers=None):
        conn = http.client.HTTPConnection('127.0.0.1', self.server.server_port)
        h = {'Content-Type': 'application/json', 'Cookie': self.cookie}
        h.update(headers or {})
        conn.request('POST' if body is not None else 'GET', '/api/v1/auth/' + path,
                     json.dumps(body) if body is not None else None, h)
        response = conn.getresponse()
        cookie = response.getheader('Set-Cookie')
        if cookie:
            self.cookie = cookie.split(';')[0]
        result = response.status, json.loads(response.read())
        conn.close()
        return result

    def signup(self, **changes):
        return self.request('signup', {'name': 'Test User', 'email': 'test@example.invalid',
                                      'password': 'A long local test password', **changes})

    def test_full_session_lifecycle_and_password_storage(self):
        status, result = self.signup()
        self.assertEqual(status, 200)
        self.assertEqual(result['user']['role'], 'customer')
        self.assertEqual(self.request('session')[1]['user']['id'], result['user']['id'])
        with self.store.connect() as db:
            row = db.execute('SELECT * FROM users').fetchone()
            self.assertNotEqual(row['password'], 'A long local test password')
            self.assertNotIn(self.cookie.split('=')[1], str(list(db.execute('SELECT * FROM sessions'))))
        old_cookie = self.cookie
        self.assertEqual(self.request('logout', {})[0], 200)
        self.cookie = old_cookie
        self.assertIsNone(self.request('session')[1]['user'])
        status, _ = self.request('login', {'email': 'TEST@example.invalid', 'password': 'A long local test password'})
        self.assertEqual(status, 200)
        self.assertNotEqual(self.cookie, old_cookie)

    def test_invalid_credentials(self):
        self.signup()
        status, _ = self.request('login', {'email': 'test@example.invalid', 'password': 'incorrect'})
        self.assertEqual(status, 401)

    def test_duplicate_account(self):
        self.signup()
        self.assertEqual(self.signup()[0], 409)

    def test_validation_and_role_escalation(self):
        self.assertEqual(self.signup(password='short')[0], 400)
        self.assertEqual(self.signup(email='invalid')[0], 400)
        self.assertEqual(self.signup(role='operator')[1]['user']['role'], 'customer')

    def test_cross_site_rejected(self):
        status, _ = self.request('signup', {}, {'Origin': 'https://other.example'})
        self.assertEqual(status, 403)

    def test_session_expiry(self):
        self.signup()
        with self.store.connect() as db:
            db.execute('UPDATE sessions SET expires=0')
        self.assertIsNone(self.request('session')[1]['user'])

    def test_google_explicitly_unconfigured(self):
        self.assertIsNone(self.request('config')[1]['googleClientId'])
        self.assertEqual(self.request('google', {})[0], 404)

    def test_attempt_rate_limit(self):
        for _ in range(20):
            self.request('login', {'email': 'missing@example.invalid', 'password': 'incorrect'})
        self.assertEqual(self.request('login', {'email': 'missing@example.invalid', 'password': 'incorrect'})[0], 429)


if __name__ == '__main__':
    unittest.main()
