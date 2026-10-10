import { ListInboxHandler } from './list-inbox.handler';

describe('inbox polling with mutable filters', () => {
  it('retains a safe cursor after its conversation becomes read', async () => {
    const prisma: any = { chatConversation: { findFirst: jest.fn(async ({where}) => where.staffUnreadCount ? null : {id:'cursor-1'}), findMany: jest.fn().mockResolvedValue([]) } };
    const result = await new ListInboxHandler(prisma).execute({staffUserId:'staff-a',staffRole:'RECEPTIONIST',unreadOnly:true,cursor:'cursor-1',limit:20});
    expect(result.data).toEqual([]);
    expect(prisma.chatConversation.findFirst).toHaveBeenCalledWith({where:{AND:[{OR:[{assignedStaffUserId:null},{assignedStaffUserId:'staff-a'}]}],id:'cursor-1'},select:{id:true}});
  });
  it('rejects a cursor outside the staff access boundary', async () => {
    const prisma: any = {chatConversation:{findFirst:jest.fn().mockResolvedValue(null),findMany:jest.fn()}};
    await expect(new ListInboxHandler(prisma).execute({staffUserId:'staff-a',staffRole:'RECEPTIONIST',cursor:'outsider',limit:20})).rejects.toThrow('Conversation cursor not found');
    expect(prisma.chatConversation.findMany).not.toHaveBeenCalled();
  });
});
