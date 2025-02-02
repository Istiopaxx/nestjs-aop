import { Injectable, OnModuleInit } from '@nestjs/common';
import { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';
import { InstanceWrapper } from '@nestjs/core/injector/instance-wrapper';
import { ASPECT } from './aspect';
import { LazyDecorator } from './lazy-decorator';

/**
 * Aspect 가 선언되어 있고 LazyDecorator 가 구현되어 있는 provider 가 있는 경우 ioc 에 등록된 모든 provider 를 순회하면서 LazyDecorator 를 적용함.
 */
@Injectable()
export class AutoAspectExecutor implements OnModuleInit {
  private readonly wrappedMethodCache = new WeakMap();
  constructor(
    private readonly discoveryService: DiscoveryService,
    private readonly metadataScanner: MetadataScanner,
    private readonly reflector: Reflector,
  ) {}

  onModuleInit() {
    const controllers = this.discoveryService.getControllers();
    const providers = this.discoveryService.getProviders();

    const lazyDecorators = this.lookupLazyDecorators(providers);
    if (lazyDecorators.length === 0) {
      return;
    }

    const instanceWrappers = providers
      .concat(controllers)
      .filter(({ instance }) => instance && Object.getPrototypeOf(instance));

    for (const wrapper of instanceWrappers) {
      const target = wrapper.isDependencyTreeStatic()
        ? wrapper.instance
        : wrapper.metatype.prototype;

      // Use scanFromPrototype for support nestjs 8
      const methodNames = this.metadataScanner.scanFromPrototype(
        target,
        wrapper.isDependencyTreeStatic() ? Object.getPrototypeOf(target) : target,
        (name) => name,
      );

      for (const methodName of methodNames) {
        lazyDecorators.forEach((lazyDecorator) => {
          const metadataKey = this.reflector.get(ASPECT, lazyDecorator.constructor);

          const metadataList: {
            originalFn: any;
            metadata?: unknown;
            aopSymbol: symbol;
          }[] = this.reflector.get(metadataKey, target[methodName]);
          if (!metadataList) {
            return;
          }

          for (const { originalFn, metadata, aopSymbol } of metadataList) {
            const proxy = new Proxy(target[methodName], {
              apply: (_, thisArg, args) => {
                const cached = this.wrappedMethodCache.get(thisArg) || {};
                if (cached[aopSymbol]?.[methodName]) {
                  return Reflect.apply(cached[aopSymbol][methodName], lazyDecorator, args);
                }
                const wrappedMethod = lazyDecorator.wrap({
                  instance: thisArg,
                  methodName,
                  method: originalFn.bind(thisArg),
                  metadata,
                });
                cached[aopSymbol] ??= {};
                cached[aopSymbol][methodName] = wrappedMethod;
                this.wrappedMethodCache.set(thisArg, cached);
                return Reflect.apply(wrappedMethod, thisArg, args);
              },
            });

            target[aopSymbol] ??= {};
            target[aopSymbol][methodName] = proxy;
          }
        });
      }
    }
  }

  private lookupLazyDecorators(providers: InstanceWrapper[]): LazyDecorator[] {
    const { reflector } = this;

    return providers
      .filter((wrapper) => wrapper.isDependencyTreeStatic())
      .filter(({ instance, metatype }) => {
        if (!instance || !metatype) {
          return false;
        }
        const aspect =
          reflector.get<string>(ASPECT, metatype) ||
          reflector.get<string>(ASPECT, Object.getPrototypeOf(instance).constructor);

        if (!aspect) {
          return false;
        }

        return typeof instance.wrap === 'function';
      })
      .map(({ instance }) => instance);
  }
}
