// Compatibility exports for existing adapter tests and private developer tools.
// App features use services.js instead of depending on a provider implementation.
export {
  SupabaseClient as CloudClient,
  validateConfig,
} from './providers/supabase.js?v=f7bbc01b5bdc';
export { CloudError } from './errors.js?v=f7bbc01b5bdc';
export { takeSignInReturn } from './sign-in-return.js?v=f7bbc01b5bdc';
