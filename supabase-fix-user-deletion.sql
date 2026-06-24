-- ==============================================================
-- AYKA CRM - Fix User Deletion (Foreign Key Constraint Update)
-- Run this in your Supabase SQL Editor to allow safe user deletion.
-- ==============================================================

-- 1. Drop the existing foreign key constraint that blocks deletion
ALTER TABLE public.leads 
DROP CONSTRAINT IF EXISTS leads_assigned_user_id_fkey;

-- 2. Re-create the constraint with ON DELETE SET NULL.
-- This ensures that if a user is deleted, their assigned leads are not deleted,
-- but instead their assigned_user_id is set to NULL.
ALTER TABLE public.leads
ADD CONSTRAINT leads_assigned_user_id_fkey 
FOREIGN KEY (assigned_user_id) 
REFERENCES public.profiles(id) 
ON DELETE SET NULL;
