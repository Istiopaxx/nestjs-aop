import { Inject, Injectable, Scope } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { SetOriginalTrue } from '../foo/foo.decorator';
import { Baz } from './baz.decorator';

@Injectable({ scope: Scope.REQUEST })
export class BazService {
  constructor(@Inject(REQUEST) private readonly request: any) {}

  getUrl() {
    return this.request.url;
  }

  @Baz({ options: 'options' })
  @SetOriginalTrue()
  baz(arg1: string, arg2: number) {
    return arg1 + arg2;
  }

  @Baz({ options: '0' })
  thisTest() {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    bazThisValue = this;
  }

  @Baz({ options: '0' })
  bazOnce() {
    return 'once';
  }

  @Baz({ options: '0' })
  @Baz({ options: '1' })
  bazTwice() {
    return 'twice';
  }
}

export let bazThisValue: any;

@Injectable()
export class StaticBazService {
  @Baz({ options: '0' })
  bazOnce() {
    return 'once';
  }

  @Baz({ options: '0' })
  @Baz({ options: '1' })
  bazTwice() {
    return 'twice';
  }
}
