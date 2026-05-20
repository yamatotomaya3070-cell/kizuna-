import { createClient } from "@supabase/supabase-js";
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const { error } = await supabase.from("tasks").select("id").limit(1);
console.log(error ? `tasks table: ERROR — ${error.message}` : "tasks table: OK");
