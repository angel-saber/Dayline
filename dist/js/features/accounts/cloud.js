// Compatibility exports for existing adapter tests and private developer tools.
// App features use services.js instead of depending on a provider implementation.
export {
  SupabaseClient as CloudClient,
  validateConfig,
} from './providers/supabase.js?v=3bc29ba06496';
export { CloudError } from './errors.js?v=3bc29ba06496';
export { takeSignInReturn } from './sign-in-return.js?v=3bc29ba06496';
