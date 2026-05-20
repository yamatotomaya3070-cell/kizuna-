import { createClient } from "@supabase/supabase-js";
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const { data: list } = await supabase.auth.admin.listUsers({ perPage: 200 });
const sakura = list.users.find(u => u.email === "sakura@example.com");
console.log("sakura.id:", sakura.id);

// .single() で取得
const single = await supabase.from("profiles").select("*").eq("id", sakura.id).single();
console.log("single:", JSON.stringify(single, null, 2));

// 全件
const all = await supabase.from("profiles").select("*").eq("id", sakura.id);
console.log("all rows for id:", JSON.stringify(all, null, 2));
