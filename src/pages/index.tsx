import { useEffect, useState } from 'react';
import styles from '../styles/Home.module.css';

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [relationships, setRelationships] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const userId = params.get('userId');
    const telegramId = params.get('telegramId');

    if (userId) {
      fetchUser(userId);
      fetchRelationships(userId);
    }

    setLoading(false);
  }, []);

  async function fetchUser(userId: string) {
    try {
      const res = await fetch(`/api/users?id=${userId}`);
      const data = await res.json();
      setUser(data);
    } catch (err) {
      console.error('Error fetching user:', err);
    }
  }

  async function fetchRelationships(userId: string) {
    try {
      const res = await fetch(`/api/relationships?userId=${userId}`);
      const data = await res.json();
      setRelationships(data);
    } catch (err) {
      console.error('Error fetching relationships:', err);
    }
  }

  if (loading) {
    return <div className={styles.container}>Loading...</div>;
  }

  if (!user) {
    return (
      <div className={styles.container}>
        <h1>Relationship Manager</h1>
        <p>Open the Telegram bot to get started: t.me/Fambam123_bot</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <h1>👋 Welcome, {user.email}!</h1>

      <section>
        <h2>Your Relationships ({relationships.length})</h2>
        {relationships.length === 0 ? (
          <p>No relationships yet. Add some via the Telegram bot!</p>
        ) : (
          <ul>
            {relationships.map((rel: any) => (
              <li key={rel.id}>
                <strong>{rel.name}</strong> ({rel.relation})
                {rel.birthDate && ` - Birthday: ${new Date(rel.birthDate).toLocaleDateString()}`}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <p>
          <a href="https://t.me/Fambam123_bot">📱 Open Telegram Bot</a>
        </p>
      </section>
    </div>
  );
}
