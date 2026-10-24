// Compatibility exports for existing adapter tests and private developer tools.
// App features use services.js instead of depending on a provider implementation.
export {
  SupabaseClient as CloudClient,
  validateConfig,
} from './providers/supabase.js?v=c5c32a011f1c';
export { CloudError } from './errors.js?v=c5c32a011f1c';
export { takeSignInReturn } from './sign-in-return.js?v=c5c32a011f1c';
