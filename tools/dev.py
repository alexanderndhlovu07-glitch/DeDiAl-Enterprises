"""Recovered DeDiAl development server. Python 3.10+; no third-party dependencies.

Serves both recovered sites and a newly implemented LOCAL email/session API.
This is not the recovered production backend or a production deployment server.
"""
import argparse
import hashlib
import hmac
from http import HTTPStatus
from http.cookies import SimpleCookie
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import re
import secrets
import sqlite3
import threading
import time
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
SESSION_SECONDS = 86400


class Store:
    def __init__(self, path):
        self.path = str(path)
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        with self.connect() as db:
            db.executescript('''
                CREATE TABLE IF NOT EXISTS users (
                    id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL,
                    name TEXT NOT NULL, salt TEXT NOT NULL, password TEXT NOT NULL,
                    role TEXT NOT NULL DEFAULT 'customer');
                CREATE TABLE IF NOT EXISTS sessions (
                    token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL,
                    expires INTEGER NOT NULL);
            ''')
        self.dummy_salt = secrets.token_hex(16)
        self.dummy_password = self.password_hash('not-a-real-account', self.dummy_salt)

    def connect(self):
        db = sqlite3.connect(self.path, timeout=10)
        db.row_factory = sqlite3.Row
        return db

    @staticmethod
    def password_hash(password, salt):
        return hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt),
                              n=16384, r=8, p=1).hex()

    @staticmethod
    def public(row):
        return {key: row[key] for key in ('id', 'email', 'name', 'role')} | {'provider': 'email'}

    def create_user(self, name, email, password):
        salt = secrets.token_hex(16)
        user_id = secrets.token_hex(16)
        encoded = self.password_hash(password, salt)
        with self.connect() as db:
            db.execute('INSERT INTO users(id,email,name,salt,password) VALUES(?,?,?,?,?)',
                       (user_id, email, name, salt, encoded))
            return self.public(db.execute('SELECT * FROM users WHERE id=?', (user_id,)).fetchone())

    def login(self, email, password):
        with self.connect() as db:
            row = db.execute('SELECT * FROM users WHERE email=?', (email,)).fetchone()
        actual = self.password_hash(password, row['salt'] if row else self.dummy_salt)
        valid = hmac.compare_digest(actual, row['password'] if row else self.dummy_password)
        return self.public(row) if row and valid else None

    def new_session(self, user_id):
        token = secrets.token_urlsafe(32)
        with self.connect() as db:
            db.execute('DELETE FROM sessions WHERE expires <= ?', (int(time.time()),))
            db.execute('INSERT INTO sessions VALUES(?,?,?)',
                       (hashlib.sha256(token.encode()).hexdigest(), user_id, int(time.time()) + SESSION_SECONDS))
        return token

    def session(self, token):
        with self.connect() as db:
            row = db.execute('''SELECT users.* FROM users JOIN sessions ON users.id=sessions.user_id
                WHERE token_hash=? AND expires>?''',
                (hashlib.sha256(token.encode()).hexdigest(), int(time.time()))).fetchone()
        return self.public(row) if row else None

    def logout(self, token):
        with self.connect() as db:
            db.execute('DELETE FROM sessions WHERE token_hash=?', (hashlib.sha256(token.encode()).hexdigest(),))


class SiteServer(ThreadingHTTPServer):
    daemon_threads = True

    def __init__(self, address, site, store, landing_port, platform_port):
        self.site = site
        self.store = store
        self.landing_port = landing_port
        self.platform_port = platform_port
        self.failures = {}
        self.failure_lock = threading.Lock()
        super().__init__(address, Handler)


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT / args[2].site), **kwargs)

    def end_headers(self):
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Referrer-Policy', 'same-origin')
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def log_message(self, fmt, *args):
        # Do not log paths, query strings, bodies, passwords, or cookies.
        pass

    def list_directory(self, path):
        self.send_error(HTTPStatus.NOT_FOUND)
        return None

    def json_response(self, data, status=200, token=None, clear=False):
        body = json.dumps(data).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        if token is not None or clear:
            self.send_header('Set-Cookie', 'dedial_session=' + (token or '') +
                             '; HttpOnly; SameSite=Lax; Path=/; Max-Age=' + ('0' if clear else str(SESSION_SECONDS)))
        self.end_headers()
        self.wfile.write(body)

    def session_token(self):
        cookie = SimpleCookie()
        try:
            cookie.load(self.headers.get('Cookie', ''))
            return cookie['dedial_session'].value if 'dedial_session' in cookie else ''
        except Exception:
            return ''

    def do_GET(self):
        path = urlsplit(self.path).path
        if path == '/config.js':
            host = urlsplit('http://' + self.headers.get('Host', 'localhost')).hostname or 'localhost'
            if ':' in host:
                host = '[' + host + ']'
            config = ({'platformUrl': f'http://{host}:{self.server.platform_port}/'}
                      if self.server.site == 'landing' else
                      {'landingUrl': f'http://{host}:{self.server.landing_port}/'})
            body = ('window.DEDIAL_CONFIG=Object.freeze(' + json.dumps(config) + ');\n').encode()
            self.send_response(200)
            self.send_header('Content-Type', 'text/javascript; charset=utf-8')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        elif path.startswith('/api/'):
            if self.server.site != 'platform':
                self.json_response({'message': 'Not found.'}, 404)
            elif path == '/api/v1/auth/session':
                self.json_response({'user': self.server.store.session(self.session_token())})
            elif path == '/api/v1/auth/config':
                self.json_response({'googleClientId': None, 'googleNonce': None, 'googleOAuthUrl': None})
            else:
                self.json_response({'message': 'This endpoint was not recovered. Local email sign-in is available.'}, 404)
        else:
            super().do_GET()

    def do_POST(self):
        path = urlsplit(self.path).path
        if self.server.site != 'platform' or path not in {
                '/api/v1/auth/signup', '/api/v1/auth/login', '/api/v1/auth/logout'}:
            return self.json_response({'message': 'Not found.'}, 404)
        # Browser requests must come from this server, with JSON rather than a cross-site form.
        origin = self.headers.get('Origin')
        if (origin and origin != 'http://' + self.headers.get('Host', '')) or self.headers.get('Sec-Fetch-Site') == 'cross-site':
            return self.json_response({'message': 'Origin not allowed.'}, 403)
        if self.headers.get('Content-Type', '').split(';')[0].strip().lower() != 'application/json':
            return self.json_response({'message': 'JSON required.'}, 415)
        try:
            size = int(self.headers.get('Content-Length', '0'))
            if not 0 < size <= 8192:
                return self.json_response({'message': 'Invalid request size.'}, 413)
            data = json.loads(self.rfile.read(size))
            if not isinstance(data, dict):
                raise ValueError()
        except (ValueError, UnicodeError):
            return self.json_response({'message': 'Invalid JSON.'}, 400)
        if path.endswith('/logout'):
            self.server.store.logout(self.session_token())
            return self.json_response({'user': None}, clear=True)
        email, password = data.get('email'), data.get('password')
        if not isinstance(email, str) or len(email) > 254 or not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+', email.strip()):
            return self.json_response({'message': 'Enter a valid email address.'}, 400)
        if not isinstance(password, str) or not 1 <= len(password) <= 128:
            return self.json_response({'message': 'Enter a valid password.'}, 400)
        email = email.strip().lower()
        ip = self.client_address[0]
        now = time.time()
        with self.server.failure_lock:
            # Bound in-memory tracking even during repeated attempts from many clients.
            self.server.failures = {key: [t for t in values if t > now - 60]
                                    for key, values in self.server.failures.items() if any(t > now - 60 for t in values)}
            attempts = self.server.failures.setdefault(ip, [])
            if len(attempts) >= 20:
                return self.json_response({'message': 'Too many attempts. Try again in a minute.'}, 429)
            attempts.append(now)
        if path.endswith('/signup'):
            name = data.get('name')
            if not isinstance(name, str) or not 1 <= len(name.strip()) <= 100 or len(password) < 12:
                return self.json_response({'message': 'Use a name and a password of at least 12 characters.'}, 400)
            try:
                user = self.server.store.create_user(name.strip(), email, password)
            except sqlite3.IntegrityError:
                return self.json_response({'message': 'An account already exists. Please log in.'}, 409)
        else:
            user = self.server.store.login(email, password)
            if not user:
                return self.json_response({'message': 'Email or password is incorrect.'}, 401)
        self.server.store.logout(self.session_token())
        self.json_response({'user': user, 'verificationRequired': False},
                           token=self.server.store.new_session(user['id']))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--host', default='127.0.0.1')
    parser.add_argument('--platform-port', type=int, default=4173)
    parser.add_argument('--landing-port', type=int, default=4174)
    parser.add_argument('--db', type=Path, default=ROOT / '.local/accounts.sqlite3')
    parser.add_argument('--set-role', nargs=2, metavar=('EMAIL', 'ROLE'))
    args = parser.parse_args()
    store = Store(args.db)
    if args.set_role:
        email, role = args.set_role
        if role not in {'customer', 'owner', 'operator'}:
            parser.error('Role must be customer, owner, or operator.')
        with store.connect() as db:
            result = db.execute('UPDATE users SET role=? WHERE email=?', (role, email.strip().lower()))
            if result.rowcount != 1:
                parser.error('Create the local account first.')
        print('Local account role updated. Reload the platform.')
        return
    servers = []
    try:
        for site, port in [('landing', args.landing_port), ('platform', args.platform_port)]:
            server = SiteServer((args.host, port), site, store, args.landing_port, args.platform_port)
            servers.append(server)
            threading.Thread(target=server.serve_forever, daemon=True).start()
        print('Recovered DeDiAl sites running. Landing port: %s; platform port: %s.' %
              (args.landing_port, args.platform_port), flush=True)
        print('Local development authentication only; Google sign-in is not configured.', flush=True)
        threading.Event().wait()
    except KeyboardInterrupt:
        pass
    finally:
        for server in servers:
            server.shutdown()
            server.server_close()


if __name__ == '__main__':
    main()
