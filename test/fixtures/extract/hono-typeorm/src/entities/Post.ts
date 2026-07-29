import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  ManyToMany,
  JoinTable,
  CreateDateColumn,
  Index,
  JoinColumn,
} from "typeorm";
import { User } from "./User";
import { Category } from "./Category";

@Entity()
@Index(["authorId"])
@Index(["title", "published"])
export class Post {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "varchar", length: 500 })
  title: string;

  @Column({ type: "text", nullable: true })
  content: string | null;

  @Column({ type: "boolean", default: false })
  published: boolean;

  @Column()
  authorId: number;

  @ManyToOne(() => User, (user) => user.posts)
  @JoinColumn({ name: "authorId" })
  author: User;

  @ManyToMany(() => Category, (category) => category.posts)
  @JoinTable()
  categories: Category[];

  @CreateDateColumn()
  createdAt: Date;
}
