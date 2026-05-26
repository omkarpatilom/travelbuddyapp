#r "nuget: BCrypt.Net-Next, 4.0.3"
using BCrypt.Net;
Console.WriteLine(BCrypt.Net.BCrypt.HashPassword("Password123!"));
