import { useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  Clock,
  Phone,
  ScrollText,
  ShieldCheck,
  Sparkles,
  Users,
  UtensilsCrossed,
} from 'lucide-react';
import heroImage from './assets/saray-hero.png';
import grillImage from './assets/mixed-grill.png';
import dessertsImage from './assets/desserts-drinks.png';
import aboutImage from './assets/about-tradition.png';
import logoImage from './assets/saray-logo.webp';
import { menuSections as localMenuSections } from './data/menu.js';

const API_URL = import.meta.env.VITE_API_URL || '';
const restaurantAddress = '94 Dunlop St W, Barrie, ON L4N 1A8';
const instagramUrl = 'https://www.instagram.com/sarayturkishcuisine.ca/';

async function api(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || 'Something went wrong.');
  }

  return data;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function formatPrice(price) {
  return `$${price.toFixed(2)}`;
}

function slugify(value) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .replace(/İ/g, 'I')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function getItemImage(itemName) {
  return `/menu-items/${slugify(itemName)}.webp`;
}

function formatTimestamp(value) {
  if (!value) {
    return 'Not recorded';
  }

  return new Intl.DateTimeFormat('en-CA', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function useRevealAnimation() {
  useEffect(() => {
    const nodes = document.querySelectorAll('[data-animate]');
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
          }
        });
      },
      { threshold: 0.14 }
    );

    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);
}

function App() {
  useRevealAnimation();
  const isStaffSite = window.location.pathname.startsWith('/staff');

  return isStaffSite ? <StaffSite /> : <CustomerSite />;
}

function CustomerSite() {
  const [menuSections, setMenuSections] = useState(localMenuSections);
  const [activeSectionId, setActiveSectionId] = useState(localMenuSections[0].id);
  const [loginPhone, setLoginPhone] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [reservations, setReservations] = useState([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [booking, setBooking] = useState({
    name: '',
    phone: '',
    date: todayIso(),
    time: '18:30',
    partySize: 2,
    occasion: 'Dinner',
    notes: '',
  });

  useEffect(() => {
    api('/api/menu')
      .then((data) => setMenuSections(data.sections))
      .catch(() => setMenuSections(localMenuSections));
  }, []);

  const activeSection = useMemo(
    () => menuSections.find((section) => section.id === activeSectionId) || menuSections[0],
    [activeSectionId, menuSections]
  );

  const activeImage = useMemo(() => {
    if (['kebabs', 'combos', 'doner'].includes(activeSection.id)) {
      return grillImage;
    }

    if (['desserts', 'drinks'].includes(activeSection.id)) {
      return dessertsImage;
    }

    return heroImage;
  }, [activeSection.id]);

  async function handleLogin(event) {
    event.preventDefault();
    setError('');
    setMessage('');

    try {
      const data = await api('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ phone: loginPhone }),
      });
      setCustomerPhone(data.phone);
      setReservations(data.reservations);
      setBooking((current) => ({ ...current, phone: data.phone }));
      setMessage('Mobile number loaded. Your current reservations are shown below.');
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleBooking(event) {
    event.preventDefault();
    setError('');
    setMessage('');

    try {
      const data = await api('/api/reservations', {
        method: 'POST',
        body: JSON.stringify(booking),
      });
      setCustomerPhone(data.reservation.phone);
      setLoginPhone(data.reservation.phone);
      setReservations((current) => [...current, data.reservation]);
      setMessage(`Reservation created. Keep this reference: ${data.reservation.reference}.`);
      setBooking((current) => ({ ...current, name: '', notes: '' }));
    } catch (err) {
      setError(err.message);
    }
  }

  async function cancelReservation(reference) {
    setError('');
    setMessage('');

    try {
      const data = await api(`/api/reservations/${reference}/cancel`, {
        method: 'PATCH',
        body: JSON.stringify({ phone: customerPhone || loginPhone || booking.phone }),
      });
      setReservations((current) =>
        current.map((reservation) => (reservation.reference === reference ? data.reservation : reservation))
      );
      setMessage(`Reservation ${reference} cancelled.`);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="site-shell customer-shell">
      <nav className="top-nav">
        <BrandMark href="#home" subtitle="Turkish Cuisine" />
        <div className="nav-links">
          <a href="#about">About</a>
          <a href="#menu">Menu</a>
          <a href="#reserve">Reservations</a>
          <a href="#visit">Visit</a>
          <a className="staff-link" href="/staff">Staff</a>
        </div>
      </nav>

      <header id="home" className="hero" style={{ backgroundImage: `linear-gradient(90deg, rgba(47, 3, 13, 0.92), rgba(85, 7, 25, 0.58), rgba(20, 2, 8, 0.16)), url(${heroImage})` }}>
        <div className="hero-pattern" aria-hidden="true" />
        <div className="hero-content" data-animate>
          <img className="hero-logo" src={logoImage} alt="Saray logo" />
          <p className="eyebrow">Barrie Turkish dining</p>
          <h1>Saray Turkish Cuisine</h1>
          <p className="hero-copy">
            Food, it is an experience: rich Turkish flavours, warm hospitality, and a maroon palace-inspired table.
          </p>
          <div className="hero-actions">
            <a className="primary-button" href="#reserve">
              Book a table
            </a>
            <a className="secondary-button" href="#menu">
              Explore menu
            </a>
          </div>
        </div>
        <div className="hero-card" data-animate>
          <Sparkles size={22} />
          <strong>Instant booking references</strong>
          <span>Customers receive an on-screen reference after reserving and can find or cancel bookings by mobile number.</span>
        </div>
      </header>

      <main>
        <section className="intro-band" data-animate>
          <div>
            <p className="eyebrow">A palace-inspired table</p>
            <h2>Tradition, passion, and modern reservations.</h2>
          </div>
          <div className="feature-grid">
            <Feature icon={<UtensilsCrossed />} title="Visual Menu" text="Every dish gets a real menu photo and a story-rich presentation." />
            <Feature icon={<Phone />} title="Mobile Login" text="Guests load bookings by mobile number." />
            <Feature icon={<ShieldCheck />} title="Staff View" text="Members manage live reservations at /staff." />
          </div>
        </section>

        <section id="about" className="about-section" data-animate>
          <div className="about-visuals">
            <img className="about-main-image" src={aboutImage} alt="Traditional Turkish dining table at Saray" />
            <div className="about-small-grid" aria-label="Saray food visuals">
              <img src={grillImage} alt="Mixed grill platter at Saray" />
              <img src={dessertsImage} alt="Turkish desserts and drinks at Saray" />
            </div>
          </div>
          <div className="about-copy">
            <p className="eyebrow">About Saray</p>
            <h2>Traditional Turkish hospitality, served with a modern reservation experience.</h2>
            <p>
              Saray is built around the feeling of a Turkish table: warm bread, shared meze, charcoal-grilled kebabs,
              sweet desserts, tea glasses, and the generous hospitality that turns dinner into an experience.
            </p>
            <p>
              The restaurant’s maroon, cream, and brass identity is inspired by a palace-style atmosphere, where every
              plate feels welcoming, traditional, and made for gathering with family and friends.
            </p>
            <div className="about-points">
              <span>Traditional recipes</span>
              <span>Shared family-style dining</span>
              <span>Warm Turkish atmosphere</span>
            </div>
          </div>
        </section>

        <section id="menu" className="menu-section" data-animate>
          <div className="section-heading">
            <p className="eyebrow">Saray menu</p>
            <h2>Choose a section from the maroon mosaic.</h2>
          </div>
          <div className="menu-atlas">
            <aside className="menu-tabs" aria-label="Menu sections">
              {menuSections.map((section) => (
                <button
                  className={section.id === activeSection.id ? 'active' : ''}
                  key={section.id}
                  onClick={() => setActiveSectionId(section.id)}
                  type="button"
                >
                  <span>{section.turkishTitle}</span>
                  <strong>{section.title}</strong>
                </button>
              ))}
            </aside>

            <div className="menu-display">
              <div className="menu-visual" style={{ backgroundImage: `linear-gradient(180deg, rgba(80, 9, 26, 0.15), rgba(34, 2, 11, 0.78)), url(${activeImage})` }}>
                <span>{activeSection.turkishTitle}</span>
              </div>
              <div className="menu-copy">
                <p className="eyebrow">Featured section</p>
                <h3>{activeSection.title}</h3>
                <p>{activeSection.story}</p>
              </div>
              <div className="menu-items">
                {activeSection.items.map((item) => (
                  <article className="menu-item" key={item.name}>
                    <img
                      className="menu-item-image"
                      src={getItemImage(item.name)}
                      alt={`${item.name} at Saray Turkish Cuisine`}
                      loading="lazy"
                      onError={(event) => {
                        event.currentTarget.src = activeImage;
                      }}
                    />
                    <div className="menu-item-body">
                      <h4>{item.name}</h4>
                      <p>{item.description}</p>
                    </div>
                    <span className="menu-price">{formatPrice(item.price)}</span>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="reserve" className="reservation-layout" data-animate>
          <div className="booking-panel">
            <div className="section-heading compact">
              <p className="eyebrow">Reserve</p>
              <h2>Book a table by mobile number.</h2>
            </div>
            <form className="form-grid" onSubmit={handleBooking}>
              <label>
                Name
                <input
                  value={booking.name}
                  onChange={(event) => setBooking({ ...booking, name: event.target.value })}
                  placeholder="Guest name"
                  required
                />
              </label>
              <label>
                Mobile number
                <input
                  value={booking.phone}
                  onChange={(event) => setBooking({ ...booking, phone: event.target.value })}
                  placeholder="705 555 1234"
                  required
                />
              </label>
              <label>
                Date
                <input
                  type="date"
                  min={todayIso()}
                  value={booking.date}
                  onChange={(event) => setBooking({ ...booking, date: event.target.value })}
                  required
                />
              </label>
              <label>
                Time
                <input
                  type="time"
                  value={booking.time}
                  onChange={(event) => setBooking({ ...booking, time: event.target.value })}
                  required
                />
              </label>
              <label>
                Guests
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={booking.partySize}
                  onChange={(event) => setBooking({ ...booking, partySize: Number(event.target.value) })}
                  required
                />
              </label>
              <label>
                Occasion
                <select
                  value={booking.occasion}
                  onChange={(event) => setBooking({ ...booking, occasion: event.target.value })}
                >
                  <option>Dinner</option>
                  <option>Birthday</option>
                  <option>Family gathering</option>
                  <option>Business meal</option>
                  <option>Other</option>
                </select>
              </label>
              <label className="wide-field">
                Notes
                <textarea
                  value={booking.notes}
                  onChange={(event) => setBooking({ ...booking, notes: event.target.value })}
                  placeholder="High chair, celebration, seating preference..."
                />
              </label>
              <button className="primary-button wide-field" type="submit">
                Create reservation
              </button>
            </form>
          </div>

          <div className="portal-panel">
            <div className="portal-card">
              <ScrollText />
              <h3>Find or cancel your booking</h3>
              <p>Enter the same mobile number used for the reservation. This demo does not use OTP yet.</p>
              <form onSubmit={handleLogin} className="login-row">
                <input
                  value={loginPhone}
                  onChange={(event) => setLoginPhone(event.target.value)}
                  placeholder="Mobile number"
                  required
                />
                <button className="secondary-button" type="submit">
                  Load
                </button>
              </form>
            </div>

            {(message || error) && (
              <div className={error ? 'notice error' : 'notice success'}>
                {error || message}
              </div>
            )}

            <div className="reservation-list">
              {reservations.length === 0 ? (
                <div className="empty-state">
                  <CalendarDays />
                  <p>No reservations loaded yet.</p>
                </div>
              ) : (
                reservations.map((reservation) => (
                  <ReservationCard
                    key={reservation.reference}
                    reservation={reservation}
                    onCancel={() => cancelReservation(reservation.reference)}
                  />
                ))
              )}
            </div>
          </div>
        </section>

        <section id="visit" className="visit-band" data-animate>
          <div>
            <p className="eyebrow">Visit Saray</p>
            <h2>94 Dunlop St W, Barrie.</h2>
            <p>{restaurantAddress}</p>
          </div>
          <div className="visit-actions">
            <a
              className="primary-button"
              href="https://www.google.com/maps/search/?api=1&query=94%20Dunlop%20St%20W%2C%20Barrie%2C%20ON%20L4N%201A8"
              target="_blank"
              rel="noreferrer"
            >
              Open map
            </a>
            <a className="secondary-button" href={instagramUrl} target="_blank" rel="noreferrer">
              Instagram
            </a>
          </div>
        </section>
      </main>
    </div>
  );
}

function BrandMark({ href, subtitle }) {
  return (
    <a className="brand-mark" href={href} aria-label="Saray Turkish Cuisine home">
      <img className="brand-logo-image" src={logoImage} alt="" />
      <span>
        <strong>Saray</strong>
        <small>{subtitle}</small>
      </span>
    </a>
  );
}

function Feature({ icon, title, text }) {
  return (
    <article className="feature-card">
      <span>{icon}</span>
      <h3>{title}</h3>
      <p>{text}</p>
    </article>
  );
}

function ReservationCard({ reservation, onCancel }) {
  const canCancel = reservation.status !== 'cancelled' && reservation.status !== 'completed';

  return (
    <article className="reservation-card">
      <div>
        <span className={`status-pill ${reservation.status}`}>{reservation.status}</span>
        <h4>{reservation.reference}</h4>
        <p>
          {reservation.name}, {reservation.partySize} guest(s)
        </p>
      </div>
      <div className="reservation-meta">
        <span>
          <CalendarDays size={16} /> {reservation.date}
        </span>
        <span>
          <Clock size={16} /> {reservation.time}
        </span>
      </div>
      {canCancel && (
        <button className="ghost-button" type="button" onClick={onCancel}>
          Cancel
        </button>
      )}
    </article>
  );
}

function StaffSite() {
  const [pin, setPin] = useState('');
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [reservations, setReservations] = useState([]);
  const [filter, setFilter] = useState('all');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const filteredReservations = useMemo(() => {
    if (filter === 'all') {
      return reservations;
    }

    return reservations.filter((reservation) => reservation.status === filter);
  }, [filter, reservations]);

  const stats = useMemo(() => {
    const upcoming = reservations.filter((reservation) => !['cancelled', 'completed', 'no-show'].includes(reservation.status));
    const guests = upcoming.reduce((sum, reservation) => sum + Number(reservation.partySize || 0), 0);
    return {
      total: reservations.length,
      upcoming: upcoming.length,
      guests,
    };
  }, [reservations]);

  async function loadReservations(nextPin = pin) {
    setError('');
    setNotice('');

    try {
      const data = await api('/api/staff/reservations', {
        headers: { 'x-staff-pin': nextPin },
      });
      setReservations(data.reservations);
      setIsAuthorized(true);
      setNotice('Reservations refreshed.');
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleStaffLogin(event) {
    event.preventDefault();
    await loadReservations(pin);
  }

  async function updateStatus(reference, status) {
    setError('');
    setNotice('');

    try {
      const data = await api(`/api/staff/reservations/${reference}`, {
        method: 'PATCH',
        headers: { 'x-staff-pin': pin },
        body: JSON.stringify({ status }),
      });
      setReservations((current) =>
        current.map((reservation) => (reservation.reference === reference ? data.reservation : reservation))
      );
      setNotice(`${reference} marked ${status}.`);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="site-shell staff-shell">
      <nav className="top-nav staff-nav">
        <BrandMark href="/" subtitle="Staff reservations" />
        <div className="nav-links">
          <a href="/">Customer site</a>
        </div>
      </nav>

      <main className="staff-main">
        <section className="staff-hero" data-animate>
          <div>
            <p className="eyebrow">Restaurant member site</p>
            <h1>Reservation command table</h1>
            <p>See upcoming bookings, guest counts, mobile numbers, notes, and update table status during service.</p>
          </div>
          <div className="staff-stats">
            <Stat label="Total" value={stats.total} />
            <Stat label="Open" value={stats.upcoming} />
            <Stat label="Guests" value={stats.guests} />
          </div>
        </section>

        {!isAuthorized ? (
          <section className="staff-login-card" data-animate>
            <ShieldCheck />
            <h2>Enter staff PIN</h2>
            <p>Default local PIN is 2468. Change it in `.env` with `STAFF_PIN` before real use.</p>
            <form onSubmit={handleStaffLogin} className="login-row">
              <input
                value={pin}
                onChange={(event) => setPin(event.target.value)}
                placeholder="Staff PIN"
                type="password"
                required
              />
              <button className="primary-button" type="submit">
                Open dashboard
              </button>
            </form>
            {error && <div className="notice error">{error}</div>}
          </section>
        ) : (
          <section className="dashboard-grid">
            <div className="dashboard-toolbar">
              <div className="filter-pills">
                {['all', 'pending', 'confirmed', 'seated', 'completed', 'cancelled', 'no-show'].map((status) => (
                  <button
                    className={filter === status ? 'active' : ''}
                    key={status}
                    onClick={() => setFilter(status)}
                    type="button"
                  >
                    {status}
                  </button>
                ))}
              </div>
              <button className="secondary-button" type="button" onClick={() => loadReservations()}>
                Refresh
              </button>
            </div>

            {(notice || error) && <div className={error ? 'notice error' : 'notice success'}>{error || notice}</div>}

            <div className="staff-reservation-list">
              {filteredReservations.length === 0 ? (
                <div className="empty-state">
                  <Users />
                  <p>No reservations match this filter.</p>
                </div>
              ) : (
                filteredReservations.map((reservation) => (
                  <article className="staff-reservation-card" key={reservation.reference}>
                    <div className="staff-card-top">
                      <div>
                        <span className={`status-pill ${reservation.status}`}>{reservation.status}</span>
                        <h3>{reservation.name}</h3>
                        <p>{reservation.reference}</p>
                      </div>
                      <strong>{reservation.partySize} guests</strong>
                    </div>
                    <dl className="staff-detail-grid">
                      <div>
                        <dt>Customer</dt>
                        <dd>{reservation.name}</dd>
                      </div>
                      <div>
                        <dt>Mobile</dt>
                        <dd>
                          <Phone size={15} /> {reservation.phone}
                        </dd>
                      </div>
                      <div>
                        <dt>Date</dt>
                        <dd>
                          <CalendarDays size={15} /> {reservation.date}
                        </dd>
                      </div>
                      <div>
                        <dt>Time</dt>
                        <dd>
                          <Clock size={15} /> {reservation.time}
                        </dd>
                      </div>
                      <div>
                        <dt>Party size</dt>
                        <dd>{reservation.partySize} guest(s)</dd>
                      </div>
                      <div>
                        <dt>Occasion</dt>
                        <dd>{reservation.occasion || 'Not specified'}</dd>
                      </div>
                      <div>
                        <dt>Created</dt>
                        <dd>{formatTimestamp(reservation.createdAt)}</dd>
                      </div>
                      <div>
                        <dt>Updated</dt>
                        <dd>{formatTimestamp(reservation.updatedAt)}</dd>
                      </div>
                      <div className="staff-detail-wide">
                        <dt>Reference</dt>
                        <dd>{reservation.reference}</dd>
                      </div>
                      <div className="staff-detail-wide">
                        <dt>Customer notes</dt>
                        <dd>{reservation.notes || 'No notes from customer.'}</dd>
                      </div>
                    </dl>
                    <div className="status-actions">
                      {['confirmed', 'seated', 'completed', 'cancelled', 'no-show'].map((status) => (
                        <button type="button" key={status} onClick={() => updateStatus(reservation.reference, status)}>
                          {status}
                        </button>
                      ))}
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="stat-card">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

export default App;
