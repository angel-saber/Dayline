// Compatibility exports for existing adapter tests and private developer tools.
// App features use services.js instead of depending on a provider implementation.
export {
  SupabaseClient as CloudClient,
  validateConfig,
} from './providers/supabase.js?v=c0487c930675';
export { CloudError } from './errors.js?v=c0487c930675';
export { takeSignInReturn } from './sign-in-return.js?v=c0487c930675';
