import { createClient } from "@supabase/supabase-js";
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const email = `test-${Date.now()}@example.com`;
const { data, error } = await supabase.auth.admin.createUser({
  email,
  password: "testpass1234",
  email_confirm: true,
  user_metadata: { role: "facility" },
});
console.log("error:", JSON.stringify(error, null, 2));
console.log("data:", JSON.stringify(data, null, 2));

if (data?.user) {
  await supabase.auth.admin.deleteUser(data.user.id);
  console.log("cleaned up");
}
