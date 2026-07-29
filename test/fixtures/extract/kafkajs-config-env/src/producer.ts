import { Kafka } from "kafkajs";
import { ORDER_TOPIC, EventTopics } from "./topics";

const kafka = new Kafka({ brokers: ["localhost:9092"] });
const producer = kafka.producer();

const envPrefix = process.env.TOPIC_PREFIX;

export async function publishOrder() {
  // Constant topic → high confidence
  await producer.send({
    topic: ORDER_TOPIC,
    messages: [{ value: "order-data" }],
  });
}

export async function publishUserEvent() {
  // Enum topic → high confidence
  await producer.send({
    topic: EventTopics.USER_CREATED,
    messages: [{ value: "user-data" }],
  });
}

export async function publishWithEnvPrefix() {
  // Template literal with env var → medium confidence
  await producer.send({
    topic: `${envPrefix}-notifications`,
    messages: [{ value: "notification" }],
  });
}
