import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'User ID required' });
    }

    try {
      const relationships = await prisma.relationship.findMany({
        where: { userId },
        include: { customDates: true },
      });

      res.status(200).json(relationships);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Error fetching relationships' });
    }
  } else if (req.method === 'POST') {
    const { userId, name, relation, birthDate } = req.body;

    if (!userId || !name) {
      return res.status(400).json({ error: 'User ID and name required' });
    }

    try {
      const relationship = await prisma.relationship.create({
        data: {
          userId,
          name,
          relation,
          birthDate: birthDate ? new Date(birthDate) : null,
        },
      });

      res.status(201).json(relationship);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Error creating relationship' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
