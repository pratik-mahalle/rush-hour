'use client';
import * as React from 'react';
import {Dialog as Primitive} from 'radix-ui';
import {X} from 'lucide-react';
import {cn} from '@/lib/utils';
export const Dialog=Primitive.Root;
export function DialogHeader({className,...props}:React.ComponentProps<'div'>){return <div className={cn('flex flex-col gap-2',className)} {...props}/>}
export function DialogFooter({className,...props}:React.ComponentProps<'div'>){return <div className={cn('flex flex-wrap justify-end gap-2',className)} {...props}/>}
export function DialogTitle({className,...props}:React.ComponentProps<typeof Primitive.Title>){return <Primitive.Title data-slot="dialog-title" className={cn('text-lg font-semibold',className)} {...props}/>}
export function DialogDescription({className,...props}:React.ComponentProps<typeof Primitive.Description>){return <Primitive.Description data-slot="dialog-description" className={cn('text-sm text-muted-foreground',className)} {...props}/>}
export function DialogContent({className,children,...props}:React.ComponentProps<typeof Primitive.Content>){const opener=React.useRef<HTMLElement|null>(null);return <Primitive.Portal><Primitive.Overlay className="fixed inset-0 z-50 bg-black/70"/><Primitive.Content onOpenAutoFocus={()=>{opener.current=document.activeElement instanceof HTMLElement?document.activeElement:null}} onCloseAutoFocus={e=>{if(opener.current?.isConnected){e.preventDefault();opener.current.focus()}}} className={cn('fixed top-1/2 left-1/2 z-50 grid w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 rounded-lg border border-border bg-background p-6 shadow-xl',className)} {...props}>{children}<Primitive.Close className="absolute top-3 right-3 p-2 text-muted-foreground" aria-label="Close"><X size={18}/></Primitive.Close></Primitive.Content></Primitive.Portal>}
