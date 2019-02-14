import { IDatasource } from '@csnext/cs-core';

export class Project implements IDatasource {
  public id = 'project-datasource';
  
  public init() {

  }

  public execute(): Promise<any> {
    
    this.init();
    return new Promise((resolve, reject) => {
      resolve(this);    
    });
  }
}
