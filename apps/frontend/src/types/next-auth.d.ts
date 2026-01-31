// ============================================================================
// CHATVISTA - NextAuth Type Declarations
// Extending NextAuth types for custom user properties
// ============================================================================

import 'next-auth';
import { JWT } from 'next-auth/jwt';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      image?: string;
      role: string;
      createdAt?: string;
    };
    accessToken: string;
    refreshToken: string;
  }

  interface User {
    id: string;
    email: string;
    name: string;
    image?: string;
    avatar?: string;
    accessToken: string;
    refreshToken: string;
    role: string;
    createdAt?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    accessToken: string;
    refreshToken: string;
    role: string;
  }
}
