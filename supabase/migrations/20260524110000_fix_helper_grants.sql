-- Re-grant helper function execute to authenticated (used by RLS policies)

GRANT EXECUTE ON FUNCTION public.get_user_business_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_business_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_business_member(uuid) TO authenticated;
