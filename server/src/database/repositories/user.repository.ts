// user.repository.ts
import { User } from "../models/user.model";

export const findUserByEmail = (email: string) => User.findOne({ email });
export const createUser = (data: Partial<typeof User>) => new User(data).save();
