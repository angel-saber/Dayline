// Compatibility exports for existing adapter tests and private developer tools.
// App features use services.js instead of depending on a provider implementation.
export {
  SupabaseClient as CloudClient,
  validateConfig,
} from './providers/supabase.js?v=bb7124230ebb';
export { CloudError } from './errors.js?v=bb7124230ebb';
export { takeSignInReturn } from './sign-in-return.js?v=bb7124230ebb';
