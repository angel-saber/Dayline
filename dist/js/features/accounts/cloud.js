// Compatibility exports for existing adapter tests and private developer tools.
// App features use services.js instead of depending on a provider implementation.
export {
  SupabaseClient as CloudClient,
  validateConfig,
} from './providers/supabase.js?v=e2556e318b26';
export { CloudError } from './errors.js?v=e2556e318b26';
export { takeSignInReturn } from './sign-in-return.js?v=e2556e318b26';
