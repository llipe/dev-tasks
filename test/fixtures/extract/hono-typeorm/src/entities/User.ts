import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  Index,
} from "typeorm";
import { Post } from "./Post";

export enum UserRole {
  USER = "user",
  ADMIN = "admin",
  MODERATOR = "moderator",
}

@Entity()
@Index(["email"])
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "varchar", length: 255, unique: true })
  email: string;

  @Column({ type: "varchar", nullable: true })
  name: string | null;

  @Column({ type: "enum", enum: UserRole, default: UserRole.USER })
  role: UserRole;

  @OneToMany(() => Post, (post) => post.author)
  posts: Post[];

  @CreateDateColumn()
  createdAt: Date;
}
