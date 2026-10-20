/**
 * DeDial local demonstration domain.
 * All records and monetary values are illustrative; no external services are called.
 * State-mutating functions return the created or updated record and throw on invalid input.
 */
export const seedBusinesses = [
  { id: 'studio-noir', name: 'Studio Noir', category: 'Beauty & grooming', location: 'Kabulonga, Lusaka', price: 250, duration: 60, serviceName: 'Signature cut & finish', staff: ['Mwewa', 'Chanda'], description: 'A little time for yourself. Contemporary cuts and considered care in a calm, welcoming studio.' },
  { id: 'precision-auto', name: 'Precision Auto', category: 'Automotive', location: 'Woodlands, Lusaka', price: 450, duration: 60, serviceName: 'Vehicle inspection', staff: ['David', 'Mutale'], description: 'Keep life moving with a thorough vehicle inspection and a clear explanation of what comes next.' },
  { id: 'still-wellness', name: 'Still Wellness', category: 'Wellness', location: 'Roma, Lusaka', price: 350, duration: 60, serviceName: 'Restorative massage', staff: ['Grace', 'Lombe'], description: 'Space to slow down. Restorative treatments designed around your comfort and wellbeing.' },
  { id: 'form-creative', name: 'Form Creative', category: 'Creative services', location: 'Longacres, Lusaka', price: 600, duration: 90, serviceName: 'Brand discovery session', staff: ['Daniel', 'Natasha'], description: 'Turn your next idea into a clear direction with a focused session for your brand or business.' },
];

export const seedSuppliers = [
  { id: 'shenzhen-connect', name: 'Shenzhen Connect', location: 'Shenzhen, China', category: 'Electronics', unitPrice: 185, price: 185, moq: 10, transit: '12–18 business days', description: 'Illustrative consumer electronics supplier. Product specifications and credentials require verification.', demo: true },
  { id: 'guangzhou-digital', name: 'Guangzhou Digital', location: 'Guangzhou, China', category: 'Electronics', unitPrice: 165, price: 165, moq: 20, transit: '15–22 business days', description: 'Illustrative volume sourcing option. Product specifications and credentials require verification.', demo: true },
  { id: 'yiwu-tech', name: 'Yiwu Tech Supply', location: 'Yiwu, China', category: 'Electronics', unitPrice: 145, price: 145, moq: 50, transit: '20–28 business days', description: 'Illustrative wholesale option. Product specifications and credentials require verification.', demo: true },
];

export function createInitialState() {
  return { profile: null, businesses: structuredClone(seedBusinesses), bookings: [], requests: [], orders: [], notifications: [] };
}

function requiredText(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} is required.`);
  return value.trim();
}

function positiveInteger(value, label) {
  const numeric = Number(value);
  if (!Number.isSafeInteger(numeric) || numeric <= 0) throw new Error(`${label} must be a positive whole number.`);
  return numeric;
}

function nonnegativeMoney(value, label) {
  if (value === '' || value === null || value === undefined) throw new Error(`${label} is required.`);
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0 || numeric > Number.MAX_SAFE_INTEGER / 100) throw new Error(`${label} must be a valid nonnegative amount.`);
  return Math.round((numeric + Number.EPSILON) * 100) / 100;
}

function validDate(date) {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(`${date}T12:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === date;
}

function timeMinutes(time) {
  if (typeof time !== 'string' || !/^\d{2}:\d{2}$/.test(time)) return NaN;
  const [hours, minutes] = time.split(':').map(Number);
  return hours < 24 && minutes < 60 ? hours * 60 + minutes : NaN;
}

function currentLusakaTime() {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Lusaka', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date()).map(part => [part.type, part.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, minutes: Number(parts.hour) * 60 + Number(parts.minute) };
}

function nextId(prefix) {
  const random = globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${random}`;
}

function notify(state, message) {
  state.notifications.push({ id: nextId('notice'), message, createdAt: new Date().toISOString(), read: false, demo: true });
}

/** Returns bookable half-hour start times in Lusaka time, from 09:00 through 16:00. */
export function availableSlots({ date, staff, businessId, bookings = [], duration = 60 }) {
  if (!validDate(date)) return [];
  const minutes = Number(duration);
  if (!Number.isInteger(minutes) || minutes <= 0 || minutes > 480) return [];
  const now = currentLusakaTime();
  if (date < now.date) return [];
  const active = bookings.filter(booking => booking.date === date && booking.staff === staff && booking.businessId === businessId && !['cancelled', 'rejected', 'expired'].includes(booking.status));
  const slots = [];
  for (let start = 9 * 60; start <= 16 * 60; start += 30) {
    if (start + minutes > 17 * 60 || (date === now.date && start <= now.minutes)) continue;
    if (active.some(booking => {
      const bookedStart = timeMinutes(booking.time);
      const bookedEnd = bookedStart + Number(booking.duration || 60);
      return start < bookedEnd && start + minutes > bookedStart;
    })) continue;
    slots.push(`${String(Math.floor(start / 60)).padStart(2, '0')}:${String(start % 60).padStart(2, '0')}`);
  }
  return slots;
}

export function makeBooking(state, { businessId, serviceName, date, time, staff, customerName, paymentMethod = 'Pay at venue' }) {
  const business = state.businesses.find(item => item.id === businessId);
  if (!business) throw new Error('Choose a listed business.');
  const name = requiredText(customerName, 'Customer name');
  if (!business.staff.includes(staff)) throw new Error('Choose a member of this business’s staff.');
  if (!availableSlots({ date, staff, businessId, bookings: state.bookings, duration: business.duration }).includes(time)) throw new Error('That time is unavailable. Choose another future appointment.');
  const booking = { id: nextId('booking'), businessId, businessName: business.name, serviceName: serviceName?.trim() || business.serviceName, date, time, staff, customerName: name, paymentMethod, price: business.price, duration: business.duration, currency: 'ZMW', status: 'confirmed', paymentStatus: 'unpaid', createdAt: new Date().toISOString(), demo: true };
  state.bookings.push(booking);
  notify(state, `Demo booking confirmed: ${booking.businessName} on ${date} at ${time}.`);
  return booking;
}

export function cancelBooking(state, id) {
  const booking = state.bookings.find(item => item.id === id);
  if (!booking) throw new Error('Booking not found.');
  if (booking.status === 'cancelled') return booking;
  if (booking.status !== 'confirmed') throw new Error('Only a confirmed booking can be cancelled.');
  booking.status = 'cancelled';
  booking.cancelledAt = new Date().toISOString();
  notify(state, `Demo booking cancelled: ${booking.businessName}. No money was charged or refunded.`);
  return booking;
}

/** Illustrative estimate only; excludes customs, taxes, insurance and changing FX rates. */
export function estimateQuote({ quantity, unitPrice, shipping = 0 }) {
  const count = positiveInteger(quantity, 'Quantity');
  const unit = nonnegativeMoney(unitPrice, 'Unit price');
  const freight = nonnegativeMoney(shipping, 'Shipping');
  if (!Number.isInteger(freight)) throw new Error('Shipping must be a whole ZMW amount.');
  const subtotalCents = Math.round(unit * 100) * count;
  const feeCents = Math.round(subtotalCents * 0.05);
  const totalCents = subtotalCents + feeCents + Math.round(freight * 100);
  if (![subtotalCents, feeCents, totalCents].every(Number.isSafeInteger)) throw new Error('The estimate amount is too large.');
  return { quantity: count, unitPrice: unit, subtotal: subtotalCents / 100, serviceFee: feeCents / 100, shipping: freight, total: totalCents / 100, currency: 'ZMW', excludes: ['Customs and taxes', 'Insurance', 'Exchange-rate changes'], demo: true };
}

export function createProcurementRequest(state, { product, quantity, budget, details = '' }) {
  const request = { id: nextId('request'), product: requiredText(product, 'Product'), quantity: positiveInteger(quantity, 'Quantity'), budget: budget === '' || budget == null ? null : nonnegativeMoney(budget, 'Budget'), details: String(details).trim(), status: 'reviewing', createdAt: new Date().toISOString(), demo: true };
  state.requests.push(request);
  notify(state, `Demo sourcing request received: ${request.product}.`);
  return request;
}

/** A repeat accepted checkout for the same request returns the existing order. */
export function confirmQuote(state, { requestId, supplierId, shipping = 0, accepted }) {
  if (accepted !== true) throw new Error('Review and explicitly accept the quote before creating an order.');
  const request = state.requests.find(item => item.id === requestId);
  if (!request) throw new Error('Sourcing request not found.');
  const existing = state.orders.find(item => item.requestId === requestId);
  if (existing) return existing;
  const supplier = seedSuppliers.find(item => item.id === supplierId);
  if (!supplier) throw new Error('Choose a listed supplier.');
  if (request.quantity < supplier.moq) throw new Error(`This supplier requires at least ${supplier.moq} units.`);
  const quote = estimateQuote({ quantity: request.quantity, unitPrice: supplier.unitPrice, shipping });
  const createdAt = new Date().toISOString();
  const order = { id: nextId('order'), requestId, product: request.product, quantity: request.quantity, supplierId, supplierName: supplier.name, transit: supplier.transit, quote, total: quote.total, currency: 'ZMW', status: 'awaiting_payment', paymentStatus: 'unpaid', createdAt, acceptedAt: createdAt, demo: true, timeline: [{ status: 'awaiting_payment', label: 'Quote accepted', at: createdAt }] };
  state.orders.push(order);
  request.status = 'quoted';
  notify(state, `Demo quote accepted for ${request.product}. Payment has not been taken.`);
  return order;
}

/** Simulates payment locally and must never be represented as a real payment. */
export function simulatePayment(state, orderId) {
  const order = state.orders.find(item => item.id === orderId);
  if (!order) throw new Error('Order not found.');
  if (order.demoPayment === true) return order;
  if (order.status !== 'awaiting_payment') throw new Error('This order is not awaiting payment.');
  order.status = 'processing';
  order.paymentStatus = 'simulated';
  order.demoPayment = true;
  order.paidAt = new Date().toISOString();
  order.timeline.push({ status: 'processing', label: 'Demo payment simulated — no money moved', at: order.paidAt });
  notify(state, `Payment simulation complete for ${order.product}. No real money was moved.`);
  return order;
}
