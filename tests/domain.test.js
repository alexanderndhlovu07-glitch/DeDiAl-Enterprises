import test from 'node:test';
import assert from 'node:assert/strict';
import {createInitialState, availableSlots, makeBooking, cancelBooking, createProcurementRequest, confirmQuote, simulatePayment} from '../platform/src/domain.js';

test('booking collision prevents duplicate appointments; cancellation reopens the slot', () => {
  const state = createInitialState();
  const date = new Date(Date.now()+86400000*2).toISOString().slice(0,10);
  const selection = {businessId:'studio-noir', staff:'Mwewa', date, duration:60};
  const time = availableSlots({...selection, bookings:state.bookings})[0];
  assert.ok(time);
  const data = {...selection, time, customerName:'Local Test'};
  const booking = makeBooking(state, data);
  assert.throws(() => makeBooking(state, data), /unavailable/);
  cancelBooking(state, booking.id);
  assert.ok(availableSlots({...selection, bookings:state.bookings}).includes(time));
});

test('sourcing requires consent, creates one order, and simulates payment once', () => {
  const state = createInitialState();
  const request = createProcurementRequest(state, {product:'Headphones', quantity:20, budget:6000});
  const data = {requestId:request.id, supplierId:'shenzhen-connect', shipping:100};
  assert.throws(() => confirmQuote(state, data), /accept/);
  const order = confirmQuote(state, {...data, accepted:true});
  assert.equal(confirmQuote(state, {...data, accepted:true}).id, order.id);
  assert.equal(state.orders.length, 1);
  simulatePayment(state, order.id);
  simulatePayment(state, order.id);
  assert.equal(order.paymentStatus, 'simulated');
  assert.equal(order.timeline.length, 2);
});

test('independent customer state does not share mutable records', () => {
  const first = createInitialState(), second = createInitialState();
  first.businesses[0].name = 'Changed';
  createProcurementRequest(first, {product:'Chairs', quantity:20});
  assert.equal(second.businesses[0].name, 'Studio Noir');
  assert.equal(second.requests.length, 0);
});
