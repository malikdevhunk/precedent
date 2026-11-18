import { createDecisionService } from '../core/service';
import { KvsDecisionRepository } from '../storage/kvs-repository';
import { productVisibility } from './visibility';

export function appService() {
  return createDecisionService({
    repo: new KvsDecisionRepository(),
    visibility: productVisibility(),
    now: () => new Date().toISOString(),
    newId: () => crypto.randomUUID(),
  });
}
