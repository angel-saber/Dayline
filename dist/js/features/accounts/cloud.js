// Compatibility exports for existing adapter tests and private developer tools.
// App features use services.js instead of depending on a provider implementation.
export {
  SupabaseClient as CloudClient,
  validateConfig,
} from './providers/supabase.js?v=a6ca893d82ed';
export { CloudError } from './errors.js?v=a6ca893d82ed';
export { takeSignInReturn } from './sign-in-return.js?v=a6ca893d82ed';
