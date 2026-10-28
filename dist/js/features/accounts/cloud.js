// Compatibility exports for existing adapter tests and private developer tools.
// App features use services.js instead of depending on a provider implementation.
export {
  SupabaseClient as CloudClient,
  validateConfig,
} from './providers/supabase.js?v=e3a1bdfe567b';
export { CloudError } from './errors.js?v=e3a1bdfe567b';
export { takeSignInReturn } from './sign-in-return.js?v=e3a1bdfe567b';
