// Compatibility exports for existing adapter tests and private developer tools.
// App features use services.js instead of depending on a provider implementation.
export {
  SupabaseClient as CloudClient,
  validateConfig,
} from './providers/supabase.js?v=ac12573d358a';
export { CloudError } from './errors.js?v=ac12573d358a';
export { takeSignInReturn } from './sign-in-return.js?v=ac12573d358a';
