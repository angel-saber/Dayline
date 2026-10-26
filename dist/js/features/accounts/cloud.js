// Compatibility exports for existing adapter tests and private developer tools.
// App features use services.js instead of depending on a provider implementation.
export {
  SupabaseClient as CloudClient,
  validateConfig,
} from './providers/supabase.js?v=99c68c40b4e2';
export { CloudError } from './errors.js?v=99c68c40b4e2';
export { takeSignInReturn } from './sign-in-return.js?v=99c68c40b4e2';
