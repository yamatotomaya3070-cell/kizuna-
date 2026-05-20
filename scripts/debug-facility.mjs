import { createClient } from "@supabase/supabase-js";
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const fac = await supabase.from("facilities").select("*");
console.log("facilities:", JSON.stringify(fac, null, 2));

const prof = await supabase.from("profiles").select("*");
console.log("profiles:", JSON.stringify(prof, null, 2));
