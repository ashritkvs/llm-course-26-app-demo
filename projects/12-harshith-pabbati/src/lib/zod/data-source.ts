import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

export const DataSourcesSchema = z.object({
  urls: z.array(
    z.object({
      url: z.string().url({ message: 'Please enter a valid URL.' }),
    })
  ),
});

export type DataSourcesSchema = z.infer<typeof DataSourcesSchema>;

export const resolver = zodResolver(DataSourcesSchema);
