import {ITestBedOptions} from 'node-test-bed-adapter';
import {Topics} from './cop-topic';

/** testbed configuration file */
export interface IExtendedTestBedOptions extends ITestBedOptions {
  /** set false to disable connecting to testbed */
  enabled?: boolean;

  topics?: Topics[];
}
