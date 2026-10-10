import { NotFoundException } from '@nestjs/common';
import { GetDepartmentHandler } from './get-department.handler';
it('reads the exact department without a 200-record cutoff and rejects missing IDs', async () => {
  const findFirst = jest.fn().mockResolvedValueOnce({id:'department-201'}).mockResolvedValueOnce(null);
  const handler = new GetDepartmentHandler({department:{findFirst}} as any);
  expect(await handler.execute({departmentId:'department-201'})).toEqual({id:'department-201'});
  expect(findFirst).toHaveBeenCalledWith({where:{id:'department-201'}});
  await expect(handler.execute({departmentId:'missing'})).rejects.toBeInstanceOf(NotFoundException);
});
