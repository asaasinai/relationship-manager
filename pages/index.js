import { useEffect, useState } from 'react';

export default function Home() {
  const [user, setUser] = useState(null);
  const [relationships, setRelationships] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const userId = params.get('userId');

    if (userId) {
      fetchUser(userId);
      fetchRelationships(userId);
    } else {
      setLoading(false);
    }
  }, []);

  async function fetchUser(userId) {
    try {
      const res = await fetch(`/api/users?id=${userId}`);
      const data = await res.json();
      setUser(data);
    } catch (err) {
      console.error('Error fetching user:', err);
    }
  }

  async function fetchRelationships(userId) {
    try {
      const res = await fetch(`/api/relationships?userId=${userId}`);
      const data = await res.json();
      setRelationships(Array.isArray(data) ? data : []);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching relationships:', err);
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem', fontFamily: 'sans-serif' }}>
        <h1>Loading...</h1>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem', fontFamily: 'sans-serif' }}>
        <h1>📅 Relationship Manager</h1>
        <p>Open the Telegram bot to get started:</p>
        <p><a href="https://t.me/Fambam123_bot">t.me/Fambam123_bot</a></p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>👋 Your Relationships</h1>

      <section style={{ padding: '1.5rem', background: '#f9f9f9', borderRadius: '8px', marginBottom: '2rem' }}>
        <h2>All Birthdays ({relationships.length})</h2>
        {relationships.length === 0 ? (
          <p>No relationships yet. Add them via the Telegram bot!</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {relationships.map((rel) => (
              <li
                key={rel.id}
                style={{
                  padding: '0.75rem',
                  borderBottom: '1px solid #eee',
                  display: 'flex',
                  justifyContent: 'space-between',
                }}
              >
                <span>
                  <strong>{rel.name}</strong> ({rel.relation})
                </span>
                <span>
                  {rel.birthDate ? new Date(rel.birthDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section style={{ padding: '1.5rem', background: '#f0f8ff', borderRadius: '8px', textAlign: 'center' }}>
        <p>📱 Manage everything via Telegram</p>
        <a
          href="https://t.me/Fambam123_bot"
          style={{
            display: 'inline-block',
            padding: '0.75rem 1.5rem',
            background: '#007bff',
            color: 'white',
            textDecoration: 'none',
            borderRadius: '4px',
          }}
        >
          Open Bot
        </a>
      </section>
    </div>
  );
}
