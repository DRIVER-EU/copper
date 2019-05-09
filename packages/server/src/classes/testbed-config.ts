import { Topics } from './cop-topic';
/** testbed configuration file */
export class TestBedConfig {
  /** set false to disable connecting to testbed */
  public enabled?: boolean;

  /** list of topic to subscribe to */
  public topics?: Topics[];  

  /** client id used by testbed adapter */
  public clientId?: string;

  /** set true to get older messages from kafka bus */
  public fromOffset?: boolean;

  /** set true to get auto register schemas to kafka */
  public autoRegisterSchemas?: boolean;

  /** kafka host url */
  public kafkaHost?: string;

  /** kafka registry url */
  public schemaRegistry?: string;
}
