const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function createUser() {
  try {
    // Check if organization exists
    let org = await prisma.organization.findFirst({
      where: { domain: 'default.chatvista.com' }
    });
    
    if (!org) {
      org = await prisma.organization.create({
        data: {
          name: 'Bonnesante Medicals',
          domain: 'default.chatvista.com',
          subscriptionTier: 'ENTERPRISE',
        }
      });
      console.log('Created organization:', org.id);
    } else {
      console.log('Using existing organization:', org.id);
    }

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email: 'sylvia4douglas@gmail.com' }
    });

    if (existingUser) {
      console.log('User already exists!');
      console.log('Email:', existingUser.email);
      console.log('ID:', existingUser.id);
      return;
    }

    // Hash password
    const passwordHash = await bcrypt.hash('BLACK@2velvet', 12);
    
    // Create user
    const user = await prisma.user.create({
      data: {
        email: 'sylvia4douglas@gmail.com',
        passwordHash: passwordHash,
        firstName: 'DR',
        lastName: 'EMMANUEL',
        displayName: 'DR EMMANUEL',
        role: 'SUPER_ADMIN',
        organizationId: org.id,
        emailVerified: true,
        status: 'ACTIVE',
        preferences: {},
      }
    });
    
    console.log('User created successfully!');
    console.log('Email:', user.email);
    console.log('ID:', user.id);
    console.log('Role:', user.role);
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

createUser();
