import type {
  PreparePublicationRequest,
  PreparedPublication,
  PublicationAdapter,
  PublicationTarget,
} from './adapters';

function disabled(target: PublicationTarget, action: 'publish' | 'verify'): never {
  throw new Error(`${target} ${action} is disabled until production publishing is explicitly enabled`);
}

export const paragraphDryRunAdapter: PublicationAdapter = {
  target: 'paragraph',
  async prepare(request: PreparePublicationRequest): Promise<PreparedPublication> {
    return {
      target: 'paragraph',
      operation: request.remoteId ? 'update-draft' : 'create-draft',
      newsletter: request.newsletter,
      externalWriteEnabled: false,
      interfaceStability: 'official-alpha',
      payload: {
        title: request.publication.title,
        subtitle: request.publication.description,
        slug: request.publication.slug,
        markdown: request.publication.body,
        sendNewsletter: false,
        sourceRevision: request.publication.sourceRevision,
      },
    };
  },
  async publish() { return disabled('paragraph', 'publish'); },
  async verify() { return disabled('paragraph', 'verify'); },
};

export const substackDryRunAdapter: PublicationAdapter = {
  target: 'substack',
  async prepare(request: PreparePublicationRequest): Promise<PreparedPublication> {
    return {
      target: 'substack',
      operation: request.remoteId ? 'update-draft' : 'create-draft',
      newsletter: request.newsletter,
      externalWriteEnabled: false,
      interfaceStability: 'no-official-publishing-api',
      payload: { portablePublication: request.publication },
    };
  },
  async publish() { return disabled('substack', 'publish'); },
  async verify() { return disabled('substack', 'verify'); },
};
