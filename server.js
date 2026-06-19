// Hostinger / cPanel Next.js startup file
process.env.NODE_ENV = 'production';

// This simply requires the newly generated standalone server after every build
// so that Hostinger always runs the latest compiled code.
require('./.next/standalone/server.js');
