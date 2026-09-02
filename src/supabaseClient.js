import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://ckcolzvopsgbwlsihjcj.supabase.co'
// Dán chính xác mã publishable key (chuỗi sb_publishable_...) vào giữa 2 dấu ' '
const supabaseAnonKey = 'sb_publishable_s142ZO8ABQtbzPPI4aWWHQ_ggLfCZvB' 

export const supabase = createClient(supabaseUrl, supabaseAnonKey)