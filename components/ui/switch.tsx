'use client';
import * as React from 'react';
import {Switch as Primitive} from 'radix-ui';
import {cn} from '@/lib/utils';
export function Switch({className,...props}:React.ComponentProps<typeof Primitive.Root>){return <Primitive.Root data-slot="switch" className={cn('inline-flex h-5 w-9 shrink-0 items-center rounded-full border-2 border-transparent bg-input data-[state=checked]:bg-primary',className)} {...props}><Primitive.Thumb className="block size-4 rounded-full bg-background transition-transform data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0"/></Primitive.Root>}
