// Compatibility exports for existing adapter tests and private developer tools.
// App features use services.js instead of depending on a provider implementation.
export {
  SupabaseClient as CloudClient,
  validateConfig,
} from './providers/supabase.js?v=d779713692b6';
export { CloudError } from './errors.js?v=d779713692b6';
export { takeSignInReturn } from './sign-in-return.js?v=d779713692b6';
