import { Inject } from "@nestjs/common";
import { TAG_CACHE } from "./tag-cache.constants";

export const InjectTagCache = (): ParameterDecorator => Inject(TAG_CACHE);

/** @deprecated Use InjectTagCache */
export const InjectSuperCache = InjectTagCache;
