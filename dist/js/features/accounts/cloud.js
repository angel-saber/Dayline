// Compatibility exports for existing adapter tests and private developer tools.
// App features use services.js instead of depending on a provider implementation.
export {
  SupabaseClient as CloudClient,
  validateConfig,
} from './providers/supabase.js?v=fe286a6e269a';
export { CloudError } from './errors.js?v=fe286a6e269a';
export { takeSignInReturn } from './sign-in-return.js?v=fe286a6e269a';
