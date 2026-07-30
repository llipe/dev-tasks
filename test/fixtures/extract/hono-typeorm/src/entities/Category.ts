import { Entity, PrimaryGeneratedColumn, Column, ManyToMany } from "typeorm";
import { Post } from "./Post";

@Entity()
export class Category {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "varchar", length: 100, unique: true })
  name: string;

  @ManyToMany(() => Post, (post) => post.categories)
  posts: Post[];
}
