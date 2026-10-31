// Compatibility exports for existing adapter tests and private developer tools.
// App features use services.js instead of depending on a provider implementation.
export {
  SupabaseClient as CloudClient,
  validateConfig,
} from './providers/supabase.js?v=f99b8ac250a9';
export { CloudError } from './errors.js?v=f99b8ac250a9';
export { takeSignInReturn } from './sign-in-return.js?v=f99b8ac250a9';
