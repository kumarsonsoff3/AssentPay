import { type Account } from "node-appwrite";
import { validatePassword } from "./validation";
import { InputError } from "../workspaces/validation";
export async function changePassword(account: Account, input: Record<string, unknown>, passwordUpdate: string) {
  const oldPassword = typeof input.oldPassword === "string" ? input.oldPassword : "";
  const password = typeof input.password === "string" ? input.password : "";
  if (!oldPassword || oldPassword.length > 256) throw new InputError("Enter your current password.");
  const invalid = validatePassword(password);
  if (invalid) throw new InputError(invalid);
  if (input.confirmPassword !== password) throw new InputError("New passwords do not match.");
  if (!passwordUpdate || passwordUpdate.startsWith("1970-")) throw new InputError("Set a password through password recovery before changing it here.");
  try { await account.updatePassword({ password, oldPassword }); }
  catch (error) {
    if (error && typeof error === "object" && "code" in error && [400, 401].includes(Number(error.code))) throw new InputError("Your current password is incorrect, or the new password was rejected.");
    throw error;
  }
}
