'use client';
import * as React from 'react';
import {Tabs as Primitive} from 'radix-ui';
import {cn} from '@/lib/utils';
export function Tabs({className,...props}:React.ComponentProps<typeof Primitive.Root>){return <Primitive.Root data-slot="tabs" className={cn('flex flex-col gap-2',className)} {...props}/>}
export function TabsList({className,variant='default',...props}:React.ComponentProps<typeof Primitive.List>&{variant?:'default'|'line'}){return <Primitive.List data-slot="tabs-list" data-variant={variant} className={cn('flex w-fit items-center rounded-lg bg-muted p-1 gap-1',variant==='line'&&'bg-transparent rounded-none',className)} {...props}/>}
export function TabsTrigger({className,...props}:React.ComponentProps<typeof Primitive.Trigger>){return <Primitive.Trigger data-slot="tabs-trigger" className={cn('relative inline-flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm text-muted-foreground data-[state=active]:bg-background data-[state=active]:text-foreground [&_svg]:size-4',className)} {...props}/>}
export function TabsContent({className,...props}:React.ComponentProps<typeof Primitive.Content>){return <Primitive.Content data-slot="tabs-content" className={cn('flex-1',className)} {...props}/>}
