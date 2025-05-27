import NextAuth, { NextAuthOptions, User, Session } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';

// Dummy user store
const users = [
  { id: '1', name: 'J Smith', email: 'jsmith@example.com', password: 'password' },
];

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials, req) {
        if (!credentials) {
          return null;
        }
        const user = users.find((user) => user.email === credentials.email);

        if (user && user.password === credentials.password) {
          // Return a user object that NextAuth.js can use
          return { id: user.id, name: user.name, email: user.email };
        } else {
          return null;
        }
      },
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
      }
      return session;
    },
  },
  pages: {
    signIn: '/auth/signin', // A custom sign-in page (optional)
  },
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
